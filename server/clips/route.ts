// GET /api/clips/:token (docs/design-docs/audio-clips.md): a round's clip, for players of the lobby that owns
// the token. The session token comes in the Authorization header, never in the URL. Every refusal is the
// same 404, never a 401 or 403, so neither kind of token can be probed.
import { Router } from 'express';
import type { Request } from 'express';
import { isToken } from '../tokens.ts';
import { CLIP_CONTENT_TYPE } from './cut.ts';
import type { ClipTokens } from './tokens.ts';

// The lobby a session token's player is in, from the session store (M4).
export type LobbyOfSession = (sessionToken: string) => string | undefined;

const BEARER = /^Bearer (\S+)$/;

function sessionLobby(req: Request, lobbyOfSession: LobbyOfSession): string | undefined {
  const sessionToken = BEARER.exec(req.get('authorization') ?? '')?.[1];
  return sessionToken !== undefined && isToken(sessionToken) ? lobbyOfSession(sessionToken) : undefined;
}

export function clipRouter(tokens: ClipTokens, lobbyOfSession: LobbyOfSession): Router {
  const router = Router();
  router.get('/api/clips/:token', (req, res) => {
    res.set('Cache-Control', 'no-store');
    const lobbyId = sessionLobby(req, lobbyOfSession);
    const { token } = req.params;
    const audio = lobbyId !== undefined && isToken(token) ? tokens.find(token, lobbyId) : undefined;
    if (audio) res.type(CLIP_CONTENT_TYPE).send(audio);
    else res.sendStatus(404);
  });
  return router;
}
