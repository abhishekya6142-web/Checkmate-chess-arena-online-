# Security Specification: Games Collection

## Data Invariants
1. A game must have a valid board state (FEN).
2. A game must have at least one player (White) upon creation.
3. Only the player whose turn it is can make a move.
4. Only the creator (White player) can delete a waiting game.
5. In Local PvP, both players must be represented or implied. (Actually the current app uses `players.w` and `players.b`).
6. A move must follow the previous state and update the FEN, turn, and history.

## The "Dirty Dozen" Payloads
1. **Unauthorized Create**: Creating a game where `players.w` is not the sender's UID.
2. **Invalid FEN Create**: Creating a game with a non-string or oversized FEN.
3. **Unauthorized Delete**: Deleting a game as a user who is not the White player.
4. **Self-Join Attack**: A user trying to join a game as both White and Black by updating `players.b` to the same UID. (Wait, the app allows this? Usually, b should be different).
5. **Turn-Steal Move**: A player making a move when it is the other player's turn.
6. **Spectator Move**: A user who is not a player trying to update the board state.
7. **History Poisoning**: Updating the history with invalid moves or oversized lists.
8. **Status Shortcut**: Moving a game status from 'waiting' directly to 'finished' without 'active'.
9. **Winner Spoofing**: Setting the winner UID to a user who is not a player in the game.
10. **ID Poisoning**: Using a document ID that is junk data or resource-intensive.
11. **Shadow Update**: Adding a `isVerified: true` field to the game document.
12. **Immutable Field Attack**: Trying to change `players.w` after the game is created.

## Security Test Runner (Mock)
A series of tests will be executed to verify:
- `PERMISSION_DENIED` for all above payloads.
- `ALLOW` for valid operations.
