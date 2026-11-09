# ADR-0008: Argon2id for Password Hashing

**Date**: 2026-11-09  
**Status**: accepted  
**Deciders**: Senior Security Architect, Technical Lead  

## Context

User authentication security depends directly on the cryptographic strength of the password hashing algorithm. We needed to choose between PBKDF2, bcrypt, scrypt, and Argon2id.

## Decision

We standardize on **Argon2id** (the hybrid variant of Argon2 recommended by RFC 9106 and the winner of the Password Hashing Competition) using a reputable, maintained Node.js implementation (`argon2`).

Parameters:
- Memory cost ($m$): **65,536 KiB (64 MB)**
- Time cost ($t$): **3 iterations**
- Parallelism ($p$): **1 thread/core**
- Salt length: **16 bytes** cryptographically secure random bytes

## Alternatives Considered

### Alternative 1: bcrypt
- **Pros**: Extremely widespread adoption.
- **Cons**: Vulnerable to custom FPGA/ASIC hardware attacks due to low memory footprint; 72-byte password truncation limit.
- **Why not**: Argon2id provides superior resistance against GPU/ASIC parallel cracking via memory hardness.

### Alternative 2: PBKDF2
- **Pros**: Available natively in Node.js `crypto` module.
- **Cons**: Compute-only algorithm with zero memory hardness; easily cracked with modern GPUs.
- **Why not**: Does not meet modern cryptographic recommendations for high-assurance systems.

## Consequences

### Positive
- State-of-the-art resistance to GPU, ASIC, and side-channel timing attacks.
- Configurable memory and time costs for production hardening.

### Negative
- Requires compiling or downloading a pre-built native binary for the Node.js runtime.

### Risks
- CPU/Memory utilization during mass concurrent logins. Mitigated by strict auth rate limiting (5 attempts per 15 minutes).
