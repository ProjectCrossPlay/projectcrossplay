# @projectcrossplay/cli

Command-line tool for [CrossPlay](https://github.com/ProjectCrossPlay/projectcrossplay): scaffold a project, diagnose your environment, run tests, and inspect traces.

## Install

```bash
npm install -D @projectcrossplay/cli
```

## Commands

```bash
crossplay init                 # scaffold crossplay.config.mts + an example spec
crossplay doctor                # check environment (Node, browsers, ADB, config)
crossplay test --target=all     # run against every configured target
crossplay show-trace <file>     # open a trace in the local viewer
```

See the [quickstart guide](https://github.com/ProjectCrossPlay/projectcrossplay/blob/main/docs/quickstart.md) for a full walkthrough (init → doctor → test in under 15 minutes).

## License

Apache-2.0
