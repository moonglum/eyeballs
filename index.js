let { spawn } = require("child_process")
let polka = require("polka")
let proxy = require("http-proxy-stream")
let port = process.env.PORT || "3000"
let http2 = require("http2")
let { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants
let Emitter = require("events")
let createSearchResultParser = require("./lib/create-search-result-parser")

let clientSession = http2.connect("https://www.youtube.com")

// TODO: Error Handling
// TODO: Do we need to strip something in the proxy function?
polka()
	.get("/watch", async (req, res) => {
		let video = await youtubeDL(
			"-f",
			"best",
			`https://www.youtube.com/watch?v=${req.query.v}`
		)
		res.setHeader("Content-Type", "text/html")
		res.end(`<!doctype html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
					<meta name="description" content="${video.description}">
					<title>${video.title}</title>
				</head>
			  <body>
					<h1>${video.title}</h1>
					<video height="${video.height}" width="${video.width}" controls>
						<source src="/stream?v=${req.query.v}" type="video/${video.ext}">
					</video>
					<p>${video.description}</p>
				</body>
			</html>`)
	})
	.get("stream", async (req, res) => {
		let { url } = await youtubeDL(
			"-f",
			"best",
			`https://www.youtube.com/watch?v=${req.query.v}`
		)
		proxy(req, { url }, res)
	})
	.get("results", async (req, res) => {
		let result = clientSession.request({
			[HTTP2_HEADER_PATH]: `/results?search_query=${req.query.search_query}`
		})

		result.on("response", headers => {
			res.statusCode = headers[HTTP2_HEADER_STATUS]

			res.write(`<!doctype html>
				<html lang="en">
					<head>
						<meta charset="utf-8">
						<title>Search Results</title>
					</head>
					<body>
						<ul>
			`)

			let emitter = new Emitter()
			emitter.on("video", ({ title, href, meta, description }) => {
				// href, title, description, meta
				res.write(`<li>
					<p><a href="${href}">${title}</a> ${description}</p>
					<ul>
						${meta.map(m => `<li>${m}</li>`).join("")}
					</ul>
				</li>`)
			})
			let parser = createSearchResultParser(emitter)

			result.on("data", parser.parse)
			result.on("close", () => {
				parser.close()
				res.end(`</ul></body></html>`)
			})
		})
	})
	.listen(port, err => {
		if (err) throw err
		console.log(`Running on localhost:${port}`)
	})

// Run youtube-dl with the provided args in `--dump-json` mode
// Return the parsed JSON
function youtubeDL(...args) {
	const command = spawn("youtube-dl", ["--dump-json", ...args])

	return new Promise((resolve, reject) => {
		let results = []

		command.stdout.on("data", data => {
			results.push(data)
		})

		command.stderr.on("data", data => {
			results.push(data)
		})

		command.on("close", code => {
			let result = JSON.parse(Buffer.concat(results))

			if (code === 0) {
				resolve(result)
			} else {
				reject(result)
			}
		})
	})
}
