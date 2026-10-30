import type { APIRoute } from 'astro';
import { isPublic } from '../lib/config';

export const GET: APIRoute = () =>
  new Response(isPublic ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n', {
    headers: { 'Content-Type': 'text/plain' },
  });
