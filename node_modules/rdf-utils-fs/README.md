# rdf-utils-fs

[![Build Status](https://travis-ci.org/rdf-ext/rdf-utils-fs.svg?branch=master)](https://travis-ci.org/rdf-ext/rdf-utils-dataset)
[![npm version](https://badge.fury.io/js/rdf-utils-fs.svg)](https://badge.fury.io/js/rdf-utils-dataset)

File system utils for RDF/JS.

## Usage

Each util function can be loaded as property from the main module or by loading only the file with the same name.

### Example

Loading the function from the main module:

    const resource = require('rdf-utils-fs').fromFile
 
Loading the function from the file with the function name:

    const resource = require('rdf-utils-fs/fromFile')
    
## Functions

### fromFile(filename, options)

Returns a quad stream for the given `filename`.

### async toFile(stream, filename, options)

Writes the given quad stream to `filename`. 
