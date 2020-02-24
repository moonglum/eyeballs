let { Parser } = require("htmlparser2")

module.exports = function() {
	let result = {}

	let parser = new Parser({
		onopentag(name, attribs) {
			if (name !== "meta") {
				return
			}

			if (matchMeta(attribs, "og:title")) {
				result.title = attribs.content
			} else if (matchMeta(attribs, "og:description")) {
				result.description = attribs.content
			} else if (matchMeta(attribs, "og:video:width")) {
				result.width = attribs.content
			} else if (matchMeta(attribs, "og:video:height")) {
				result.height = attribs.content
			}
		}
	})

	return {
		parse: parser.write.bind(parser),
		close: () => {
			parser.end(parser)
			return result
		}
	}
}

function matchMeta(attribs, property) {
	return attribs.property && attribs.property === property
}
