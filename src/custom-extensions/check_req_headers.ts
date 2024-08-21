import { Peer, IServerExtension } from "https://deno.land/x/earthstar@v10.2.2/mod.ts";

/** A server extension for exposing the contents of shares, so that you can request documents by their path and have them served over HTTP */
export class ExtensionCheckRequestHeaders implements IServerExtension {
  private peer: Peer | null = null;

  constructor() {

  }

  register(peer: Peer) {
    this.peer = peer;

    return Promise.resolve();
  }

  async handler(req: Request): Promise<Response | null> {
    console.log(req.headers)
    return await Promise.resolve(null);
  }
}
