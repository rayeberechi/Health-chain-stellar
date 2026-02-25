# @medchain/sdk

TypeScript SDK for the Healthy-Stellar health donor protocol.

## Installation

```bash
npm install @medchain/sdk
import { RecordsApi, Configuration } from '@medchain/sdk';

const config = new Configuration({
  basePath: 'http://localhost:3000/api/v1',
  accessToken: 'YOUR_TOKEN'
});

const recordsApi = new RecordsApi(config);

// Example: Fetching records
// recordsApi.recordsGet().then(res => console.log(res.data));
