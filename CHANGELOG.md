# Changelog

## 0.3.1

### Editor reachability

Remote Control is reached from the host that runs the MCP or CLI process. Default `http://127.0.0.1:30010` is that process’s loopback and works only when the process host and the Editor host are the same machine. README, the `ue-editor` skill, and the unreachable error now say to set `UE_REMOTE_CONTROL_URL` when they differ, to bind the Editor HTTP server beyond loopback (`[HTTPServer.Listeners]` `DefaultBindAddress=0.0.0.0` or the machine IP), and to allow TCP 30010. An SSH or VPN tunnel is documented as a general pattern. If there is no network path, run `ue-tools` on the Editor machine. Fail closed remains `editor_unreachable`.

### Console commands

`editor console` (and the MCP tool) always includes the command string, URL, via route (`PUT /remote/object/call`), HTTP status, and raw JSON. An empty object or empty `ReturnValue` is called out: Remote Control often does not return console stdout; check the Editor Output Log on the Editor host; HTTP success does not prove `LiveCoding.Compile` succeeded. No Output Log route is called.

### Local install

Install docs tell you to open the directory that contains `package.json`, then use `node dist/cli.js` or `npx --prefix . ue-tools`. Nesting another `UE_Tools/` folder breaks package discovery.

### Unchanged

Viewport capture is still a gap; `editor highresshot` remains the HighResShot helper. Actor list and selection still try `EditorActorSubsystem`, then `EditorLevelLibrary`. Epic’s Remote Control HTTP reference does not document a third actor-list route, so none was added. Spawning actors and loading maps stay out of scope.
