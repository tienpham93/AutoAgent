import { GraphBuilder } from "./GraphBuilder";

export class GraphManager {

    public static create(): GraphBuilder {
        return new GraphBuilder();
    }
}