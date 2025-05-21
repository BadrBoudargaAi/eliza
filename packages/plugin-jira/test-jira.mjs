import { JiraService } from './dist/jira-service.js';

const service = new JiraService({
  host: 'https://guppy-ai.atlassian.net',
  email: 'badr.boudarga@guppy-ai.com',
  apiToken: 'ATATT3xFfGF0cJFn1BgTDba8yNBmhX2Gx5fzZeiKXSqsq2hupxpS-rrWEsN0EGHvYiX01TZG2udf3gEoYDlERB-EJ7Vc4XpEZcFlXWgUNZYuKZF5MB_KaSzG2_W1shiHJHrsdU',
  project: 'GUP'
});

async function testJira() {
  try {
    const valid = await service.validateProject();
    console.log('Project validation result:', valid);
  } catch (error) {
    console.error('Error:', error);
  }
}

testJira();
