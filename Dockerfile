FROM denoland/deno:1.37.1

EXPOSE 8000
EXPOSE 443

WORKDIR /app

RUN mkdir /app/data/ \
        && chown deno:deno /app/data/
	
VOLUME [ "/app/data" ]

COPY src/custom-extensions ./custom-extensions
COPY src/server.ts ./server.ts
COPY src/known_shares.json ./known_shares.json

# Prefer not to run as root
USER deno

# Compile the main app so that it doesn't need to be compiled each startup/entry
RUN deno cache server.ts

CMD ["run", "--unstable", "--allow-all", "server.ts"]