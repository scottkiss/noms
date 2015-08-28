package types

import (
	"github.com/attic-labs/noms/chunks"
	"github.com/attic-labs/noms/ref"
)

type listLeaf struct {
	list []Future
	ref  *ref.Ref
	cs   chunks.ChunkSource
}

func newListLeaf(v ...Value) List {
	return listLeafFromFutures(valuesToFutures(v), nil)
}

func listLeafFromFutures(list []Future, cs chunks.ChunkSource) List {
	return listLeaf{list, &ref.Ref{}, cs}
}

func (l listLeaf) Len() uint64 {
	return uint64(len(l.list))
}

func (l listLeaf) Empty() bool {
	return l.Len() == uint64(0)
}

func (l listLeaf) Get(idx uint64) Value {
	return l.getFuture(idx).Deref(l.cs)
}

func (l listLeaf) getFuture(idx uint64) Future {
	return l.list[idx]
}

func (l listLeaf) Slice(start uint64, end uint64) List {
	return listFromFutures(l.list[start:end], l.cs)
}

func (l listLeaf) Set(idx uint64, v Value) List {
	// TODO: Optimize
	b := make([]Future, len(l.list))
	copy(b, l.list)
	b[idx] = futureFromValue(v)
	return listFromFutures(b, l.cs)
}

func (l listLeaf) Append(v ...Value) List {
	return listFromFutures(append(l.list, valuesToFutures(v)...), l.cs)
}

func (l listLeaf) Insert(idx uint64, v ...Value) List {
	// TODO: Optimize
	b := make([]Future, len(l.list)+len(v))
	copy(b, l.list[:idx])
	copy(b[idx:], valuesToFutures(v))
	copy(b[idx+uint64(len(v)):], l.list[idx:])
	return listFromFutures(b, l.cs)
}

func (l listLeaf) Remove(start uint64, end uint64) List {
	// TODO: Optimize
	b := make([]Future, uint64(len(l.list))-(end-start))
	copy(b, l.list[:start])
	copy(b[start:], l.list[end:])
	return listFromFutures(b, l.cs)
}

func (l listLeaf) RemoveAt(idx uint64) List {
	return l.Remove(idx, idx+1)
}

func (l listLeaf) Ref() ref.Ref {
	return ensureRef(l.ref, l)
}

// BUG 141
func (l listLeaf) Release() {
	for _, f := range l.list {
		f.Release()
	}
}

func (l listLeaf) Equals(other Value) bool {
	if other == nil {
		return false
	} else {
		return l.Ref() == other.Ref()
	}
}

func (l listLeaf) Chunks() (futures []Future) {
	for _, f := range l.list {
		if f, ok := f.(*unresolvedFuture); ok {
			futures = append(futures, f)
		}
	}
	return
}