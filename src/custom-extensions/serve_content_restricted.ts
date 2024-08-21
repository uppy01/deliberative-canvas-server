import { Peer, Replica, isErr, IServerExtension } from "https://deno.land/x/earthstar@v10.2.2/mod.ts";
import { contentType } from "https://deno.land/std@0.167.0/media_types/mod.ts";
import { extname } from "https://deno.land/std@0.154.0/path/mod.ts";

export interface ExtensionServeContentRestrictions {
  /** The share to use as the source of documents. Must have been created by another extension. */
  sourceShare?: string;
  /** Only serve content with the specified extension, ie '.json' */
  allowedExtensions?: string[];
  /** Only serve content for requests from specific origins/domains */
  allowedOrigins?: string[];
}

/** A server extension for exposing the contents of shares, so that you can request documents by their path and have them served over HTTP */
export class ExtensionServeContentRestricted implements IServerExtension {
  private peer: Peer | null = null;
  private replica: Replica | null = null;
  private sourceShare: string | null = null;
  private path: string = '/'
  private allowedOrigins: string[] = ['*']; //allow any origin to request content
  private allowedExtensions: string[] = ['*'] //serve content with any extension

  constructor(opts: ExtensionServeContentRestrictions) {

    if(opts.sourceShare) {
      this.sourceShare = opts.sourceShare;
    }

    if(opts.allowedExtensions) {
      this.allowedExtensions = opts.allowedExtensions
    }

    if(opts.allowedOrigins) {
      this.allowedOrigins = opts.allowedOrigins;
    }
  }

  register(peer: Peer) {
    this.peer = peer;

    return Promise.resolve();
  }

  async handler(req: Request): Promise<Response | null> {
    let reqOrigin:string = ''
    //if there is no 'origin' header it means request has come from same domain so no need to check 'allowedOrigins'
    if(req.headers.get('origin')) {
      reqOrigin = req.headers.get('origin') as string
      console.log('request Origin: ',reqOrigin)
    
      if(this.allowedOrigins[0] !== '*'  && !this.allowedOrigins.find((allowedOrigin) => allowedOrigin === reqOrigin)) {
        return new Response("access denied (cors)", {
          headers: {
            status: "404"
          },
        });
      }
    }
    
    if(this.allowedExtensions[0] !== '*' && !this.allowedExtensions.find((extension) => extension === extname(req.url.split('?')[0]))) {
      return new Response("access denied (extension)", {
        headers: {
          status: "404",
          "access-control-allow-origin": reqOrigin
        },
      });
    }

    //if the Share hasn't been passed in and set in the constructor, then check for it in the url query params...
    if(!this.sourceShare) {
      const url = new URL(req.url);
      this.sourceShare = url.searchParams.get("share") ? url.searchParams.get("share") as string : ''
      if(this.sourceShare) {
        //let's add the '+' back in at the beginning of the share address, as it will have been replaced by ' ' when using searchParams.get() above...see here - https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams#preserving_plus_signs
        this.sourceShare = this.sourceShare.replace(' ','+')
      }
      else {
        console.log('no share')
        return new Response("configuration error (share)", {
          headers: {
            status: "404",
            "access-control-allow-origin": reqOrigin
          },
        });
      }
    }
    
    const replica = this.peer?.getReplica(this.sourceShare);

    if(!replica) {
      return new Response("configuration error (replica)", {
        headers: {
          status: "404",
          "access-control-allow-origin": reqOrigin
        },
      });
    }

    this.replica = replica;
    
    const pathPattern = new URLPattern({
      pathname: `${this.path}*`,
    });

    const pathPatternResult = pathPattern.exec(req.url);

    if(this.replica && pathPatternResult && req.method === "GET") {
      const pathToGet = pathPatternResult.pathname.groups[0];

      const maybeDocument = await this.replica.getLatestDocAtPath(
        `/${pathToGet}`,
      );

      if(!maybeDocument) {
        return new Response("Not found", {
          headers: {
            status: "404",
            "access-control-allow-origin": reqOrigin
          },
        });
      }

      const attachment = await this.replica.getAttachment(maybeDocument);

      if(attachment && !isErr(attachment)) {
        return new Response(
          await attachment.stream(),
          {
            headers: {
              status: "200",
              "content-type": getContentType(maybeDocument.path),
              "access-control-allow-origin": reqOrigin,
              "cache-control": "no-store"
            },
          },
        );
      }

      if (attachment === undefined) {
        return new Response(
          `Not found: ${maybeDocument.text}, ${maybeDocument.attachmentSize}`,
          {
            headers: {
              status: "404",
              "content-type": getContentType(maybeDocument.path),
              "access-control-allow-origin": reqOrigin
            },
          },
        );
      }

      return new Response(
        maybeDocument.text,
        {
          headers: {
            status: "200",
            "content-type": getContentType(maybeDocument.path),
            "access-control-allow-origin": reqOrigin,
            "cache-control": "no-store"
          },
        },
      );
    }

    return Promise.resolve(null);
  }
}

function getContentType(path: string): string {
  const extension = extname(path);

  return contentType(extension) || "text/plain";
}
