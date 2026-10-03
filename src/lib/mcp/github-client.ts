import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
});

export interface GitHubEvent {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  type: 'pr' | 'release' | 'commit';
  repoName: string;
}

// Parse owner/repo from full GitHub URL
function parseRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

export async function scanGitHubRepo(repoUrl: string, sinceHours = 48): Promise<GitHubEvent[]> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) return [];

  const { owner, repo } = parsed;
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString();
  const events: GitHubEvent[] = [];

  try {
    // Fetch recent merged PRs
    const prs = await octokit.pulls.list({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 10,
    });

    for (const pr of prs.data) {
      if (pr.merged_at && new Date(pr.merged_at) > new Date(since)) {
        events.push({
          title: `[PR Merged] ${pr.title}`,
          url: pr.html_url,
          summary: pr.body ? pr.body.substring(0, 300) : 'No description provided.',
          publishedAt: pr.merged_at,
          type: 'pr',
          repoName: `${owner}/${repo}`,
        });
      }
    }

    // Fetch recent releases
    const releases = await octokit.repos.listReleases({
      owner,
      repo,
      per_page: 5,
    });

    for (const release of releases.data) {
      if (release.published_at && new Date(release.published_at) > new Date(since)) {
        events.push({
          title: `[Release] ${release.name || release.tag_name}`,
          url: release.html_url,
          summary: release.body ? release.body.substring(0, 300) : 'No release notes.',
          publishedAt: release.published_at,
          type: 'release',
          repoName: `${owner}/${repo}`,
        });
      }
    }
  } catch (err) {
    console.log(`GitHub scan failed for ${owner}/${repo}:`, err);
  }

  return events;
}
