const { createReadStream } = require('fs')
const { extname } = require('path')
const formats = require('@rdfjs/formats-common')
const defaults = require('./defaults')

function fromFile (filename, { extensions, ...options } = {}) {
  const combinedExtensions = {
    ...defaults.extensions,
    ...extensions
  }

  const extension = extname(filename).split('.').pop()
  const mediaType = combinedExtensions[extension]

  if (!mediaType) {
    throw new Error(`Unknown file extension: ${extension}`)
  }

  const parser = formats.parsers.get(mediaType)

  if (!parser) {
    throw new Error(`No parser available for media type: ${mediaType}`)
  }

  return parser.import(createReadStream(filename), options)
}

module.exports = fromFile
