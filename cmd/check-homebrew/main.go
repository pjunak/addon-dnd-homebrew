// Command check-homebrew checks a dnd-homebrew-items file offline with the
// importer's own rules, so a file written by hand or by a tool can be fixed
// before the DM previews it in the add-on or the Import Center:
//
//	go run ./cmd/check-homebrew items.json [current-export.json]
//
// The optional second file is the page's Export of the current drafts; with
// it the report says what the import would create, change, skip or remove.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/pjunak/addon-dnd-homebrew/internal/importer"
)

// maxFile matches the add-on page's import limit.
const maxFile = 2 << 20

func main() {
	if err := run(os.Args[1:], os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, "INVALID:", err)
		os.Exit(1)
	}
}

func run(args []string, out io.Writer) error {
	if len(args) < 1 || len(args) > 2 {
		return errors.New("usage: check-homebrew items.json [current-export.json]")
	}
	document, err := readLimited(args[0])
	if err != nil {
		return err
	}
	var current []byte
	if len(args) == 2 {
		if current, err = readLimited(args[1]); err != nil {
			return err
		}
	}
	report, err := importer.Check(document, current, time.Now().UnixMilli())
	if err != nil {
		return err
	}
	fmt.Fprintf(out, "VALID: %d new, %d changed, %d unchanged, %d removed (%s).\n",
		report.Summary.Creates, report.Summary.Updates, report.Summary.Skips, report.Summary.Deletes, report.Mode)
	for _, change := range report.Changes {
		fmt.Fprintf(out, "  %-6s %s/%s  %s\n", change.Operation, change.Collection, change.ID, change.Label)
	}
	for _, warning := range report.Warnings {
		fmt.Fprintln(out, "Note:", warning)
	}
	return nil
}

func readLimited(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > maxFile {
		return nil, fmt.Errorf("%s is larger than 2 MiB, the import limit", path)
	}
	return os.ReadFile(path)
}
