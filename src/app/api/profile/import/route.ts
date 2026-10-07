import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const MOCK_USER_ID = 'user_mock_id';

// LinkedIn CSV files we support and their field mappings
// LinkedIn exports vary slightly by region/account type, so we check multiple column name variants.

function parseCSV(text: string): Record<string, string>[] {
  // Strip BOM if present
  let cleanText = text;
  if (cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }
  
  const lines = cleanText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  // LinkedIn CSVs sometimes have a note/disclaimer on the first few lines before the header
  // Find the actual header row (the one with the most columns)
  let headerIdx = 0;
  let maxCols = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]).length;
    if (cols > maxCols) { maxCols = cols; headerIdx = i; }
  }

  const headers = parseCSVLine(lines[headerIdx]).map((h) => h.trim().replace(/^"|"$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
    });
    rows.push(row);
  }
  return rows;
}

// Handles quoted fields with commas inside them
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// Get the first non-empty value by checking multiple possible column names
function pick(row: Record<string, string>, ...keys: string[]): string {
  // Normalize row keys for robust matching (lowercase, no spaces)
  const normalizedRow: Record<string, string> = {};
  for (const k in row) {
    normalizedRow[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
  }

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const val = normalizedRow[normalizedKey]?.trim();
    if (val) return val;
  }
  return '';
}

function parseProfile(rows: Record<string, string>[]) {
  if (!rows.length) return null;
  const r = rows[0]; // Profile.csv has one data row
  const firstName = pick(r, 'First Name', 'FirstName');
  const lastName = pick(r, 'Last Name', 'LastName');
  
  return {
    name: `${firstName} ${lastName}`.trim(),
    headline: pick(r, 'Headline', 'headline'),
    linkedinUrl: pick(r, 'Public Profile Url', 'LinkedIn Url', 'ProfileUrl'),
    summary: pick(r, 'Summary', 'About', 'summary'),
    location: pick(r, 'Geo Location', 'Location', 'GeoLocation', 'City'),
    industry: pick(r, 'Industry', 'industry'),
  };
}

function parsePositions(rows: Record<string, string>[]) {
  return rows
    .filter((r) => pick(r, 'Company Name', 'CompanyName', 'Company'))
    .map((r) => ({
      title: pick(r, 'Title', 'Position', 'JobTitle'),
      company: pick(r, 'Company Name', 'CompanyName', 'Company'),
      startDate: pick(r, 'Started On', 'StartedOn', 'Start Date'),
      endDate: pick(r, 'Finished On', 'FinishedOn', 'End Date'),
      description: pick(r, 'Description', 'description'),
    }))
    .slice(0, 10); // cap at 10 positions
}

function parseSkills(rows: Record<string, string>[]) {
  if (!rows.length) return [];

  // LinkedIn Skills.csv has NO header ?" first line is already a skill.
  // parseCSV() treats the first line as headers, so rows have keys like
  // { "Artificial Intelligence (AI)": "" }. Detect this by checking if
  // any row has a recognised key; if not, treat all keys as the skills.
  const knownKeys = ['Name', 'Skill', 'SkillName', 'name'];
  const firstRow = rows[0];
  
  // Normalize keys for checking
  const normalizedFirstRow: Record<string, string> = {};
  for (const k in firstRow) {
    normalizedFirstRow[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = firstRow[k];
  }
  
  const hasKnownHeader = knownKeys.some(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') in normalizedFirstRow);

  if (hasKnownHeader) {
    // Standard format with a header row
    return rows
      .map((r) => pick(r, ...knownKeys))
      .filter(Boolean)
      .slice(0, 30);
  } else {
    // Headerless format ?" every row key IS the skill value
    const skills: string[] = [];
    // Collect the "header" row key (the first skill)
    for (const key of Object.keys(firstRow)) {
      if (key.trim()) skills.push(key.trim());
    }
    // Collect remaining rows ?" their keys are also skill values
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (key.trim() && !skills.includes(key.trim())) skills.push(key.trim());
      }
    }
    return skills.slice(0, 30);
  }
}

function parseEducation(rows: Record<string, string>[]) {
  return rows
    .filter((r) => pick(r, 'School Name', 'SchoolName', 'School'))
    .map((r) => ({
      school: pick(r, 'School Name', 'SchoolName', 'School'),
      degree: pick(r, 'Degree Name', 'DegreeName', 'Degree'),
      field: pick(r, 'Field Of Study', 'FieldOfStudy', 'Major'),
      startDate: pick(r, 'Start Date', 'StartDate', 'Started On'),
      endDate: pick(r, 'End Date', 'EndDate', 'Finished On'),
    }));
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];

    if (!files.length) {
      return NextResponse.json({ success: false, error: 'No files uploaded' }, { status: 400 });
    }

    let profileData: ReturnType<typeof parseProfile> = null;
    let positions: ReturnType<typeof parsePositions> = [];
    let skills: string[] = [];
    let education: ReturnType<typeof parseEducation> = [];
    const processedFiles: string[] = [];

    for (const file of files) {
      const name = file.name.toLowerCase();
      const text = await file.text();
      const rows = parseCSV(text);

      if (name.includes('profile')) {
        profileData = parseProfile(rows);
        processedFiles.push('Profile.csv');
      } else if (name.includes('position') || name.includes('experience')) {
        positions = parsePositions(rows);
        processedFiles.push('Positions.csv');
      } else if (name.includes('skill')) {
        skills = parseSkills(rows);
        processedFiles.push('Skills.csv');
      } else if (name.includes('education')) {
        education = parseEducation(rows);
        processedFiles.push('Education.csv');
      }
    }

    // Ensure mock user exists
    await prisma.user.upsert({
      where: { id: MOCK_USER_ID },
      update: {},
      create: { id: MOCK_USER_ID, name: 'User', email: 'user@example.com' },
    });

    // Build update payload
    const userUpdate: Record<string, string> = {};
    if (profileData) {
      const fullName = profileData.name.trim();
      if (fullName && fullName !== ' ') userUpdate.name = fullName;
      if (profileData.headline) userUpdate.targetRole = profileData.headline;
      if (profileData.linkedinUrl) userUpdate.linkedinUrl = profileData.linkedinUrl;
      if (profileData.location) userUpdate.targetLocation = profileData.location;
    }

    // Save user fields if anything was extracted
    if (Object.keys(userUpdate).length) {
      await prisma.user.update({ where: { id: MOCK_USER_ID }, data: userUpdate });
    }

    // Save to Profile table
    const profileUpdate: Record<string, string> = {};
    if (profileData?.summary) profileUpdate.about = profileData.summary;
    if (skills.length) profileUpdate.skills = JSON.stringify(skills);
    if (positions.length) profileUpdate.positions = JSON.stringify(positions);
    if (education.length) profileUpdate.education = JSON.stringify(education);

    if (Object.keys(profileUpdate).length) {
      await prisma.profile.upsert({
        where: { userId: MOCK_USER_ID },
        update: profileUpdate,
        create: { userId: MOCK_USER_ID, ...profileUpdate },
      });
    }

    return NextResponse.json({
      success: true,
      processedFiles,
      extracted: {
        name: userUpdate.name || null,
        headline: userUpdate.targetRole || null,
        location: userUpdate.targetLocation || null,
        linkedinUrl: userUpdate.linkedinUrl || null,
        skills: skills,
        skillCount: skills.length,
        positionCount: positions.length,
        educationCount: education.length,
      },
    });
  } catch (error: any) {
    console.error('LinkedIn CSV import error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
