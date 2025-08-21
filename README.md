# Sequence Parallel Transactions Tester

Basic React application for testing parallel transactions against Sequence Transactions API and Blockchain RPC.

Setup an `.env` file with the following parameters to have them ingested automatically:

```
VITE_SEQUENCE_PROJECT_ACCESS_KEY=
# can be dev or prod
VITE_SEQUENCE_ENV=dev
VITE_TEST_PRIVATE_KEY=
```

For testing on mainnets, it will run smoothly if you sponsor your Sequence signer wallet from your Sequence Builder project. To identify your Sequence signer wallet, use `sequence-cli`:

`npx sequence-cli wallet create-single-signer -k TEST_PRIVATE_KEY`

Afterwards, take the Sequence Wallet Single Signer address and add it on the correct network under Gas Sponsorship in your project, and make sure your gas tank is filled.
