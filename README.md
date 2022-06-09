# driver-submission
A GitHub Action to automate driver submission

# Usage

```yaml
name: Test

on: [push]

jobs:
  test:
    runs-on: windows-2019

    steps:
    - uses: actions/checkout@v2
    
    - name: 'Submit to the Microsoft Partner Center'
      uses: sentry-corporation/driver-submission@v1.1.1
      with:
        tenant-id: ${{ secrets.MY_TENANT_ID }}
        client-id: ${{ secrets.MY_CLIENT_ID }}
        client-secret: ${{ secrets.MY_CLIENT_SECRET }}
        product-name: mysub-${{ github.run_id }}
        signatures: '["WINDOWS_v100_TH2_FULL", "WINDOWS_v100_X64_TH2_FULL", "WINDOWS_v100_RS1_FULL"]'
        bin-path-in: ./yourpackage.cab
        bin-path-out: .
```

We advise you to contain all credentials on the action's secret.

## Inputs

See [action.yml](action.yml).

# Credits

- Special thanks [@doranekosystems](https://github.com/DoranekoSystems) helped transforming internal Python code into this javascript.

# License

MIT License

Copyright (c) 2022 Sentry Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

See [LICENSE](LICENSE).
