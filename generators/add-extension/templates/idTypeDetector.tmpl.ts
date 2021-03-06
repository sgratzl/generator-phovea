
function isValidIdentifier(v: string) {
  // TODO implement custom logic
  return false;
}


function detectIDType(data: any[], accessor: (row: any) => string, sampleSize: number) : number {
  const testSize = Math.min(data.length, sampleSize);
  if (testSize <= 0) {
    return 0;
  }

  let foundIDTypes = 0;
  let validSize = 0;

  for(let i = 0; i < testSize; ++i) {
    const v = accessor(data[i]);

    if (v == null || v.trim().length === 0) {
      continue; //skip empty samples
    }

    if(isValidIdentifier(v)) {
      ++foundIDTypes;
    }
    ++validSize;
  }

  return foundIDTypes / validSize;
}

export function create() {
  return {
    detectIDType
  };
}
