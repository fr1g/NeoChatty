import AddCode from "./utils/AddCode";

const GlobalScope = {
    AddCodePool: new Map<string, AddCode>(), // userId -> AddCode
    GeneratedCodeNumbers: new Set<number>(),
    LaunchedAt: Date.now(),
};

export default GlobalScope;

