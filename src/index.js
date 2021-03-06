
const core = require('@actions/core');
const github = require('@actions/github');
const { BotComments } = require("./comments");
const validate = require('./labels');

async function run() {
  const token = core.getInput('repo-token');
  const globs = core.getInput('globs', { required: true })
                    .split("\n")
                    .filter(glob => glob !== "");
  const botMessage = core.getInput('message', { required: true });

  const client = github.getOctokit(token);
  const context = github.context;

  const labels = context.payload.issue.labels.map(item => item.name);
  const isTriaged = validate(labels, globs);

  if (context.eventName === 'issues' && context.payload.action === 'labeled' && context.payload.label.name.toLowerCase() === 'bug' && !isTriaged) {
    await client.issues.createComment({
      issue_number: context.payload.issue.number,
      owner: context.repo.owner,
      repo: context.repo.repo,
      body: botMessage
    });
  }
  else if (context.eventName === 'issue_comment' && context.payload.action === 'created' && context.payload.comment.body === '/triaged') {
    const botComments = new BotComments(context, client);
    const comments = await botComments.all();
    const comment = comments.find(comment => comment.body === botMessage);
    if (isTriaged && comment !== undefined) {
      await client.issues.deleteComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: comment.id
      })
    }
    
    await client.reactions.createForIssueComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: context.payload.comment.id,
      content: isTriaged ? '+1' : '-1'
    })
  }
}

try {
  run();
} catch (error) {
  core.setFailed(error.message);
}