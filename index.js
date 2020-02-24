let { spawn } = require("child_process")
let polka = require("polka")
let proxy = require("http-proxy-stream")
let port = process.env.PORT || "3000"
let http2 = require("http2")
let { HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = http2.constants
let Emitter = require("events")
let createSearchResultParser = require("./lib/create-search-result-parser")
let createViewParser = require("./lib/create-view-parser")

let clientSession = http2.connect("https://www.youtube.com")

// TODO: Error Handling
// TODO: Do we need to strip something in the proxy function?
polka()
	.get("/", async (req, res) => {
		startResponse(req, res)
		res.end(`<h1>eyeballs</h1>
			<form action="/results">
				${
					req.query.css
						? `<input type="hidden" name="css" value="${req.query.css}">`
						: ""
				}
				<label for="search_query">Search Query</label>
				<input name="search_query" id="search_query">
				<input type="submit">
			</form>`)
	})
	.get("/watch", async (req, res) => {
		let result = clientSession.request({
			[HTTP2_HEADER_PATH]: `/watch?v=${req.query.v}`
		})

		result.on("response", headers => {
			let parser = createViewParser()

			result.on("data", parser.parse)
			result.on("close", () => {
				let video = parser.close()

				startResponse(req, res, {
					statusCode: headers[HTTP2_HEADER_STATUS],
					title: video.title
				})

				res.end(`<h1>${video.title}</h1>
							<video height="${video.height}" width="${video.width}" controls>
								<source src="/stream?v=${req.query.v}">
							</video>
							<p>${video.description}</p>`)
			})
		})
	})
	.get("stream", async (req, res) => {
		let url = await youtubeDL(
			"--get-url",
			"-f",
			"best",
			`https://www.youtube.com/watch?v=${req.query.v}`
		)
		proxy(req, { url }, res)
	})
	.get("results", async (req, res) => {
		let result = clientSession.request({
			[HTTP2_HEADER_PATH]: `/results?search_query=${encodeURIComponent(
				req.query.search_query
			)}`
		})

		result.on("response", headers => {
			startResponse(req, res, {
				statusCode: headers[HTTP2_HEADER_STATUS],
				title: "Search Results"
			})

			res.write(`<ul>`)

			let emitter = new Emitter()
			emitter.on("video", ({ title, href, meta, description }) => {
				// href, title, description, meta
				res.write(`<li>
					<p><a href="${href}&css=${req.query.css}">${title}</a> ${description}</p>
					<ul>
						${meta.map(m => `<li>${m}</li>`).join("")}
					</ul>
				</li>`)
			})
			let parser = createSearchResultParser(emitter)

			result.on("data", parser.parse)
			result.on("close", () => {
				parser.close()
				res.end()
			})
		})
	})
	.listen(port, err => {
		if (err) throw err
		console.log(`Running on localhost:${port}`)
	})

function youtubeDL(...args) {
	const command = spawn("youtube-dl", args)

	return new Promise((resolve, reject) => {
		let results = []

		command.stdout.on("data", data => {
			results.push(data)
		})

		command.on("close", code => {
			let result = Buffer.concat(results)
				.toString()
				.trim()

			if (code === 0) {
				resolve(result)
			} else {
				reject()
			}
		})
	})
}

function startResponse(
	req,
	res,
	{ statusCode = 200, title = "eyeballs" } = {}
) {
	let css = req.query.css
		? `<link rel="stylesheet" href="${req.query.css}" />`
		: ""
	res.statusCode = statusCode
	res.setHeader("Content-Type", "text/html")
	res.write(`<!doctype html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<title>${title}</title>
					${css}
				</head>
				<body>`)
}
