import AddCode from "./utils/AddCode";

const GlobalScope = {
    AddCodePool: new Map<string, AddCode>(),
    GeneratedCodeNumbers: new Set<number>(),
    LaunchedAt: Date.now(),
};

export default GlobalScope;

