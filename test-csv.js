
function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\"") {
      if (inQuotes && line[i + 1] === "\"") { current += "\""; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text) {
  const lines = text.split("\n");
  
  let headerIdx = 0;
  let maxCols = 0;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]).length;
    if (cols > maxCols) { maxCols = cols; headerIdx = i; }
  }

  const headers = parseCSVLine(lines[headerIdx]).map(h => h.trim().replace(/^"|"$/g, "").trim());
  const rows = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").replace(/^"|"$/g, "").trim();
    });
    rows.push(row);
  }
  return rows;
}

const mockCSV = `"First Name","Last Name","Maiden Name","Address","Birth Date","Headline","Summary","Industry","Zip Code","Geo Location","Twitter Handles","Websites","Instant Messengers"\n"Akash","Bhattacharya","","","","Director of Product","Experienced PM...","Tech","","Bangalore, India","","",""`;

console.log(parseCSV(mockCSV));

