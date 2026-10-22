package homebrew

import (
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
	"golang.org/x/text/language"
	"golang.org/x/text/message"

	"github.com/pjunak/addon-dnd-homebrew/contracts"
)

// The host validates collection writes and served records against contracts/
// with this library, so checking with it here refuses exactly what the host
// would. GrantsContract is the Engine's grants vocabulary, copied by
// tools/engine-grants.mts.
const (
	contractBase   = "file:///addon/contracts/"
	GrantsContract = "engine-grants.schema.json#/$defs/grants"
)

var (
	schemaMu      sync.Mutex
	schemaCache   = map[string]*jsonschema.Schema{}
	compileOnce   = sync.OnceValues(newCompiler)
	schemaPrinter = message.NewPrinter(language.English)
)

func newCompiler() (*jsonschema.Compiler, error) {
	compiler := jsonschema.NewCompiler()
	compiler.DefaultDraft(jsonschema.Draft2020)
	names, err := fs.Glob(contracts.Files, "*.json")
	if err != nil {
		return nil, err
	}
	for _, name := range names {
		body, err := contracts.Files.ReadFile(name)
		if err != nil {
			return nil, err
		}
		document, err := jsonschema.UnmarshalJSON(bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		if err := compiler.AddResource(contractBase+name, document); err != nil {
			return nil, err
		}
	}
	return compiler, nil
}

func contractSchema(ref string) (*jsonschema.Schema, error) {
	compiler, err := compileOnce()
	if err != nil {
		return nil, err
	}
	schemaMu.Lock()
	defer schemaMu.Unlock()
	if schema, cached := schemaCache[ref]; cached {
		return schema, nil
	}
	schema, err := compiler.Compile(contractBase + ref)
	if err != nil {
		return nil, err
	}
	schemaCache[ref] = schema
	return schema, nil
}

// ValidateContract checks one JSON document against a contract: a file name,
// optionally with a JSON pointer such as GrantsContract. The error names the
// first failing location.
func ValidateContract(ref string, body []byte) error {
	schema, err := contractSchema(ref)
	if err != nil {
		return fmt.Errorf("contract %s is unusable: %w", ref, err)
	}
	document, err := jsonschema.UnmarshalJSON(bytes.NewReader(body))
	if err != nil {
		return errors.New("value must be JSON")
	}
	if err := schema.Validate(document); err != nil {
		var failure *jsonschema.ValidationError
		if !errors.As(err, &failure) {
			return err
		}
		for len(failure.Causes) > 0 {
			failure = failure.Causes[0]
		}
		return fmt.Errorf("at /%s: %s", strings.Join(failure.InstanceLocation, "/"), failure.ErrorKind.LocalizedString(schemaPrinter))
	}
	return nil
}
