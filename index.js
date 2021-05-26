let { spawn } = require("child_process")
let polka = require("polka")
let helmet = require("helmet")
let port = process.env.PORT || "3000"

let requestIdFormat = /^[a-z0-9]+$/i

polka()
	.use(
		helmet({
			contentSecurityPolicy: {
				directives: {
					defaultSrc: ["'none'"],
					// source of the logo and the poster
					imgSrc: ["'self'", "*.ytimg.com"],
					// source of the video URLs
					mediaSrc: ["*.googlevideo.com"],
					// css option
					styleSrc: ["https://*"],
				},
			},
		})
	)
	.get("/", async (req, res) => {
		respond(req, res, {
			body: `<h1>Welcome to the eyeball zone 👀</h1>`,
		})
	})
	.get("/logo.svg", async (req, res) => {
		res.statusCode = 200
		res.setHeader("Content-Type", "image/svg+xml")
		res.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
			<text y=".9em" font-size="90">👀</text>
			</svg>`)
	})
	.get("/watch", async (req, res) => {
		if (!requestIdFormat.test(req.query.v)) {
			respond(req, res, {
				statusCode: 400,
				body: `<p>Sorry to say that, but this video ID looks weird</p>`,
			})
			return
		}

		try {
			let video = await youtubeDL(
				"--dump-json",
				"-f",
				"best",
				`https://www.youtube.com/watch?v=${req.query.v}`
			)

			let body = `<h1>${video.title} 👀</h1>
							<video height="${video.height}" width="${video.width}" poster=${
				video.thumbnail
			} controls>
								${sources(video.formats)}
							</video>
							${description(video.description)}`

			respond(req, res, {
				title: video.fulltitle,
				body,
			})
		} catch (err) {
			console.error(err)
			respond(req, res, {
				statusCode: 500,
				body: `<p>Sorry, something went wrong</p>`,
			})
		}
	})
	.listen(port, (err) => {
		if (err) {
			throw err
		}
		console.log(`Running on localhost:${port}`)
	})

async function youtubeDL(...args) {
	const command = spawn("youtube-dl", args)

	return new Promise((resolve, reject) => {
		let results = []

		command.stdout.on("data", (data) => {
			results.push(data)
		})

		command.on("close", (code) => {
			let result = Buffer.concat(results).toString().trim()

			if (code === 0) {
				resolve(JSON.parse(result))
			} else {
				reject()
			}
		})
	})
}

// sort by descending quality, because the browser takes the first one that fits
// TODO: this could also be sorted by `filesize` as a second parameter, because we want
// the highest quality and lowest size first
function sources(formats) {
	return formats
		.sort((a, b) => b.quality - a.quality)
		.map((format) => {
			// TODO: vcodec?
			// https://developer.mozilla.org/en-US/docs/Web/Media/Formats/codecs_parameter
			return `<source src="${format.url}" type="video/${format.ext}">`
		})
		.join("")
}

function description(text) {
	let x = text
		.replace(/http[\S]+/g, `<a href="$&" rel="noopener noreferrer">$&</a>`)
		.replace(/\n\n/g, "</p><p>")
		.replace(/\n/g, "<br>")
	return `<p>${x}</p>`
}

function respond(
	req,
	res,
	{ statusCode = 200, title = "eyeballs", body = "" } = {}
) {
	let css = req.query.css
		? `<link rel="stylesheet" href="${req.query.css}" />`
		: ""
	res.statusCode = statusCode
	res.setHeader("Content-Type", "text/html")
	res.end(`<!doctype html>
			<html lang="en">
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1">
					<link rel="icon" href="/logo.svg">
					<title>${title}</title>
					${css}
				</head>
				<body>${body}</body>
			</html>`)
}
