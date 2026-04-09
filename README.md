# vps

Repository for VPS-related files and setup.

GitHub Actions:
- Workflow check for self-hosted runner: `.github/workflows/self-hosted-check.yml`
- Workflow CI/package on runner `ipvps`: `.github/workflows/ipvps-ci.yml`
- Trigger automatically on push to `main`
- Can also be run manually from the Actions tab
- Uses `actions/checkout@v6` to stay aligned with Node 24-based GitHub Actions runtimes
- Ready to be narrowed to a custom self-hosted runner label after that label is added in GitHub runner settings
