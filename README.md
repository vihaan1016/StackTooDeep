# Updates

All changes are mentioned in this doc

## The "True x402" Update

The previous code used a psuedo implementation of the x402 protocol. This update implements the true x402 protocol.

### Major Changes

*   **Gasless Payments (EIP-3009)**: usage is now smoother. We transitioned to EIP-3009 (`TransferWithAuthorization`), allowing the backend to pay gas fees on behalf of users.
*   **True x402 Protocol**: We ditched the "pseudo" checks in the request body. Now, the API properly negotiates payments using standard HTTP headers (`WWW-Authenticate`). If you don't pay, you get a real `402 Payment Required` challenge.
*   **EIP-712 Signing**: The frontend now requests typed data signatures instead of opaque transactions, making it much clearer to users what they are signing.

### Security Upgrades

*   **Gas Guard (Circuit Breaker)**: We realized the "Gasless" model had a risk: high gas fees could drain our backend wallet. We added a protection system that tracks daily spending.
    *   **Logic**: If gas prices exceed **50 Gwei** or our daily spend hits **0.1 ETH**, the system automatically disables gasless payments and asks users to pay their own gas.
    *   **Safe Fallback**: The API properly communicates this status to the frontend via the `gasless_available` header flag.

### What actually changed

*   **Middleware Architecture**: Moved all payment logic out of the controllers and into a dedicated `x402Middleware`. This keeps our business logic clean and secure.
*   **Header-Based Authorisation**: Signatures are now passed via the `X-Payment-Signature` header, following the x402 standard more strictly.
*   **Database**: Added a new `GasSpend` model to track our wallet's health over time.
