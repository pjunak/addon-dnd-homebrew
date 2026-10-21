package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/pjunak/addon-dnd-homebrew/internal/importer"
	"github.com/pjunak/addon-dnd-homebrew/internal/provider"
	"github.com/pjunak/ttrpg-codex/sdk/go/workerrpc"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	err := workerrpc.RunNativeWorker(ctx, workerrpc.NativeWorkerConfig{
		Reader: os.Stdin, Writer: os.Stdout,
		Methods: map[string]string{
			provider.MethodPrefix + "catalog":  provider.ContractVersion,
			provider.MethodPrefix + "get":      provider.ContractVersion,
			provider.MethodPrefix + "query":    provider.ContractVersion,
			importer.MethodPrefix + "describe": importer.ContractVersion,
			importer.MethodPrefix + "preview":  importer.ContractVersion,
			importer.MethodPrefix + "commit":   importer.ContractVersion,
		},
		HandlerFactory: workerrpc.NativeWorkerHandlerFactoryFunc(newHandler),
	})
	if err != nil && ctx.Err() == nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func newHandler(worker workerrpc.NativeWorkerContext) (workerrpc.RequestHandler, error) {
	data, err := workerrpc.NewAddonDataClient(worker.Peer)
	if err != nil {
		return nil, err
	}
	rules, err := provider.New(data, os.Stderr)
	if err != nil {
		return nil, err
	}
	imports, err := importer.New(data)
	if err != nil {
		return nil, err
	}
	return workerrpc.RequestHandlerFunc(func(ctx context.Context, request workerrpc.Request) (any, error) {
		if strings.HasPrefix(request.Method, provider.MethodPrefix) {
			return rules.HandleRPC(ctx, request)
		}
		return imports.HandleRPC(ctx, request)
	}), nil
}
