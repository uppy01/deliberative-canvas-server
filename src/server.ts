import * as Earthstar from "https://deno.land/x/earthstar@v10.2.2/mod.ts";
import { ExtensionServeContentRestricted } from "./custom-extensions/serve_content_restricted.ts";

new Earthstar.Server([
    new Earthstar.ExtensionKnownShares({
        knownSharesPath: "./known_shares.json",
        onCreateReplica: (address) => {
            console.log(`Creating replica for ${address}...`);

            return new Earthstar.Replica({
                driver: new Earthstar.ReplicaDriverFs(address, "./data")
            })
        }
    }),
    new Earthstar.ExtensionSyncWeb(),
    new ExtensionServeContentRestricted({ allowedExtensions:[".json"], allowedOrigins:["https://kumu.io","https://embed.kumu.io"] })
]);