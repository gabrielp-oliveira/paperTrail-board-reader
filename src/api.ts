// api.ts
let jwtToken: string | null = null;

export function setJwtToken(token: string) {
  jwtToken = token;
  console.log("✅ JWT token definido:", token);
}

export async function request(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  body?: any
): Promise<any> {
  if (!jwtToken) {
    throw new Error("JWT token não definido. Use setJwtToken() primeiro.");
  }

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwtToken}`,
    },
    body: method !== "GET" ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Erro ${response.status}: ${await response.text()}`);
  }

  return await response.json();
}
