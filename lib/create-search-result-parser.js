let { Parser } = require("htmlparser2")

module.exports = function (emitter) {
	let result = {}

	let parser = new Parser({
		onopentag(name, attribs) {
			if (matchClass(attribs, "yt-lockup-content")) {
				result = { openTags: 0, open: true, meta: [] }
			}

			if (!result.open) {
				return
			}

			result.openTags++

			if (matchClass(attribs, "yt-uix-tile-link")) {
				result.href = attribs.href
				result.title = attribs.title
			} else if (matchClass(attribs, "yt-lockup-description")) {
				result.description = ""
				result.parseDescription = true
			} else if (matchClass(attribs, "accessible-description")) {
				result.parseDuration = true
			} else if (name === "ul" && matchClass(attribs, "yt-lockup-meta-info")) {
				result.parseMeta = true
			} else if (matchClass(attribs, "yt-lockup-playlist-items")) {
				// it's a channel, skip
				result = {}
			}
		},

		onclosetag(name) {
			if (!result.open) {
				return
			}

			result.openTags--

			if (result.openTags === 0) {
				emitter.emit("video", {
					href: result.href,
					title: result.title,
					description: result.description,
					meta: result.meta,
				})
				result = {}
			} else if (result.parseDescription) {
				result.parseDescription = false
			} else if (result.parseDuration) {
				result.parseDuration = false
			} else if (result.parseMeta && name === "ul") {
				result.parseMeta = false
			}
		},

		ontext(text) {
			if (result.parseDescription) {
				result.description += trim(text)
			} else if (result.parseDuration) {
				result.meta.push(trim(text))
			} else if (result.parseMeta) {
				result.meta.push(trim(text))
			}
		},
	})

	return {
		parse: parser.write.bind(parser),
		close: parser.end.bind(parser),
	}
}

function matchClass(attribs, klass) {
	return attribs.class && attribs.class.includes(klass)
}

// trim all non-word characters
function trim(text) {
	return text.match(/\W*(.+)\W*/)[1]
}
