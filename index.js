let { spawn } = require("child_process")
let polka = require("polka")
let proxy = require("http-proxy-stream")

// TODO: Error Handling
// TODO: The video quality seems low, can we get it higher?
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
	.listen(3000, err => {
		if (err) throw err
		console.log(`Running on localhost:3000`)
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
