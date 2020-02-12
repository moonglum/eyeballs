FROM node:13

COPY --chown=node:node . /app
WORKDIR /app
ADD https://github.com/ytdl-org/youtube-dl/releases/download/2020.01.24/youtube-dl /usr/local/bin/youtube-dl
RUN chmod 0755 /usr/local/bin/youtube-dl
USER node
RUN npm i
CMD ["/app"]
ENTRYPOINT ["node"]
