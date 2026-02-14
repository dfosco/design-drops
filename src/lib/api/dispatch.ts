export interface PendingImage {
  id: string;
  base64: string;
}

export interface WorkflowPayload {
  action: 'create' | 'edit' | 'delete';
  localID: string;
  repositoryId?: string;
  categoryId?: string;
  discussionId?: string;
  title?: string;
  body?: string;
  metadata?: Record<string, unknown>;
  pendingImages?: PendingImage[];
}

const ACTIONS_TOKEN = import.meta.env.PUBLIC_ACTIONS_TOKEN;
const REPO_OWNER = import.meta.env.PUBLIC_REPO_OWNER;
const REPO_NAME = import.meta.env.PUBLIC_REPO_NAME;

export async function dispatchWorkflow(payload: WorkflowPayload): Promise<boolean> {
  const workflowFile =
    payload.pendingImages && payload.pendingImages.length > 0
      ? 'full_workflow.yml'
      : 'lean_workflow.yml';

  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${workflowFile}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ACTIONS_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      ref: 'main',
      inputs: { payload: JSON.stringify(payload) },
    }),
  });

  return response.status === 204;
}
