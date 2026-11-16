export async function safeJson(response) {
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    if (response.status === 413) {
      throw new Error(
        "That photo/voice note is too large for the server to accept. Try a shorter recording or a smaller photo.",
      );
    }
    throw new Error(
      `The server returned an unexpected response (HTTP ${response.status}). Check the deployment logs for the failed API request.`,
    );
  }
}
