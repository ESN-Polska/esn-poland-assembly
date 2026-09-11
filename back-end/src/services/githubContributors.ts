import axios from 'axios';
import { DynamoDB } from 'idea-aws';

export interface GitHubContributor {
  login: string;
  html_url: string;
  avatar_url: string;
  contributions: number;
  name: string | null;
}

const REPOSITORY = 'ESN-Polska/esn-poland-assembly';
const CONTRIBUTORS_URL = `https://api.github.com/repos/${REPOSITORY}/contributors?per_page=100`;
const DDB_TABLE = process.env.DDB_TABLE_contributors;
const CACHE_KEY = 'contributors';
const ddb = new DynamoDB();

async function getAllContributors(): Promise<GitHubContributor[]> {
  const contributors: GitHubContributor[] = [];
  let nextURL: string = CONTRIBUTORS_URL;

  while (nextURL) {
    const response = await axios.get<any[]>(nextURL, { headers: { Accept: 'application/vnd.github+json' } });
    const users = response.data.filter(contributor => contributor.type === 'User');
    const profiles = await Promise.all(
      users.map(async contributor => {
        try {
          const profile = await axios.get<{ name: string | null }>(
            `https://api.github.com/users/${encodeURIComponent(contributor.login)}`,
            { headers: { Accept: 'application/vnd.github+json' } }
          );
          return { ...contributor, name: profile.data.name };
        } catch (_) {
          return { ...contributor, name: null };
        }
      })
    );
    contributors.push(...profiles);

    const linkHeader = response.headers.link as string | undefined;
    nextURL = linkHeader?.match(/<([^>]+)>; rel="next"/)?.[1] ?? null;
  }

  return contributors.map(({ login, html_url, avatar_url, contributions, name }) => ({
    login,
    html_url,
    avatar_url,
    contributions,
    name
  }));
}

export async function refreshGitHubContributors(): Promise<GitHubContributor[]> {
  const contributors = await getAllContributors();
  await ddb.put({
    TableName: DDB_TABLE,
    Item: { PK: CACHE_KEY, contributors, updatedAt: new Date().toISOString() }
  });
  return contributors;
}

export async function getCachedGitHubContributors(): Promise<GitHubContributor[] | null> {
  try {
    const cached = await ddb.get({ TableName: DDB_TABLE, Key: { PK: CACHE_KEY } });
    return cached?.contributors ?? null;
  } catch (_) {
    return null;
  }
}
