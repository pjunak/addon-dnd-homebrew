// Package contracts embeds the add-on's JSON Schemas, so the worker checks
// drafts and served records against the same files the host enforces.
package contracts

import "embed"

//go:embed *.json
var Files embed.FS
