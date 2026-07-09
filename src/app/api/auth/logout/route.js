import { NextResponse } from "next/server";

// Se llama desde un <form method="post"> en el navbar.
// Borramos la cookie y redirigimos al inicio.
export async function POST(request) {
  const response = NextResponse.redirect(new URL("/", request.url), 303);
  response.cookies.delete("userId");
  return response;
}
