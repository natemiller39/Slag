# Slag

A card-shedding game for 2 to 8 players. Match the target number, dump your cards, and keep your score low.

This repo is a playable web version at a forge-lit table. Play against 1 to 7 computer players, or host an online game with friends.

## Playing online

1. On the start screen, enter your name and choose **Host a game**. You get a 4-letter room code and an invite link.
2. Friends open the link, or enter the code and choose **Join**. Up to 8 seats.
3. The host can add bots to fill seats, choose the rules, and deal.
4. Everyone picks their cards privately; plays are revealed together once everyone has locked in.
5. If someone drops out, a bot plays their seat until they come back. Reopening the page rejoins the same seat.

The server (`server.js`) deals and holds every hand, so nobody can see another player's cards.

## How a round works

1. A target card sits in the middle. Everyone secretly picks up to 3 cards that add up exactly to its number. At most one may be a negative. You may pass instead.
2. Everyone reveals at once. If nobody made the number, the deal ends.
3. The best play wins the round (see "Who wins a round" below).
4. Everyone who made the number discards those cards. Anyone who passed or missed draws one penalty card, which they can't use until the next round.
5. The round winner picks a card from their hand to be the next target. That card leaves their hand.

The deal ends when someone runs out of cards or nobody can make the target.

## Who wins a round

The game offers two rules on the setup screen.

**Highest card** (default)
Any card of the target's color beats every other color, and the highest one wins. Ties fall to the sister suit, then suit rank, then the starred copy. A negative of the target's color counts as playing the color, but as the lowest card of it: it beats plays without the color and loses to any positive card of the color.

**Most of the color**
1. The play with the most cards of the target's color wins. Negatives of that color count.
2. Tied? The highest card of the target's color wins.
3. Still tied, or nobody played the color? The highest card wins, then the target's sister suit, then suit rank, then the starred copy.

Sister suits: Red & Orange, Blue & Green, Purple & Grey.
Suit rank: Blue 6, Red 5, Purple 4, Green 3, Orange 2, Grey 1 (Black, in the black suit deck, is lowest). The main colors (Blue, Red, Purple) outrank their partners.

## Option: Target line

Turn on **Target line** on the start screen or in the lobby so everyone can plan ahead.

- Start each deal with **two** face-up target cards: the current target and the next one.
- When you win a round, the card you choose joins the **back** of the line, and the next card moves up. So your card becomes the target after next.
- If nobody wins (a Quench, or the 2-player re-flip), the line moves up and a card from the draw pile refills the back.

## Option: Black suit deck

Choose **Deck: Black suit** on the start screen or in the lobby to play with one 70-card deck at every player count: the six suits plus a black suit, each 1–10 with **no doubles** (so no starred cards).

| Players | Cards each (plus a −1, −2 and −3) |
| --- | --- |
| 2–4 | 11 |
| 5 | 10 |
| 6 | 9 |
| 7 | 8 |
| 8 | 7 (plus one extra black negative set) |

- Black has no sister color and the lowest suit rank, so it never wins a tie.
- When black is the target, black cards are the target color (a black negative counts too, as the lowest).
- Black negatives pair with black cards at scoring.
- A black 6 is a Full Tang like any other 6, and Full Tangs work when black is the target.

## Option: Quench cards

Turn on **Quench cards** on the start screen or in the lobby to shuffle 0-value Quench cards into the deck: 1 at 2–3 players, 2 at 4–5, 3 at 6–8.

- Add a Quench to a play that makes the number. It counts as one of your 3 cards and can't be played alone.
- When a Quench is revealed, nobody wins the round. Everyone who made the number still discards, misses still draw, and a new target is flipped instead of being chosen by a winner.
- A Quench never becomes the target: if one is flipped, it goes under the draw pile and the next card is flipped.
- A Quench drawn as a penalty goes into your hand like any other card.
- One still in your hand at the end of a deal scores +5.
- If a Quench is played when the draw pile is empty, the deal ends.

## Option: Full Tang 6s

Turn on **Full Tang 6s** on the start screen or in the lobby. (It replaces the old Usurper card.) Every 6 is a Full Tang blade.

- A **Full Tang** play is a 6 plus at least one other card, with **no negatives**, where the 6 or another card in the play is the target's color.
- A Full Tang **always wins the round.** On a Blue 7, Red 6 + Blue 1 beats Blue 10 + −3.
- A negative cracks the blade: add one and it's just a normal play.
- If two players have a Full Tang, the normal order decides between them. A Quench still cancels the round.
- On screen, every 6 glows when the option is on so it's easy to spot.

## Option: Full Tang: one color

Turn on **Full Tang: one color** on the start screen or in the lobby. (Made for the black suit deck, but works with either.)

- All negatives are **neutral**: they have no color, never count as a color, never pair, and score **2** each if you're stuck with them.
- A **Full Tang** is a play of two or more cards that are all the target's color (so no negatives).
- A Full Tang **beats every other play**, even a higher target-color card played with a negative. On a Blue 7, Blue 4 + Blue 3 beats Blue 10 + −3.
- Between two Full Tangs, the highest target-color card wins. A Quench still cancels the round.
- This is separate from **Full Tang 6s**; both can be on at once, and either kind counts as a Full Tang.

## Option: Slag card

Turn on **Slag card** on the start screen or in the lobby to shuffle one colorless Slag card, worth 7, into the deck.

- **Played in a combo:** whoever wins that round draws a penalty card, unless it's you. The Slag card never counts as your high card. Because it's worth 7, you can only play it when the target is 4 or higher (7 alone, 7 with a negative, or 7 plus other cards).
- **As the target:** make 7. Color doesn't count, the best play wins, and the winner draws a penalty card. So everyone wants to make 7 to shed cards, but nobody wants the best play.
- A round winner can set the Slag card as the next target, which gets it out of their hand and passes the curse along.
- If a Quench is played the same round, nobody wins, so nobody gets burned.
- If the winner goes out that round, the deal ends before they would draw.
- Stuck with it at the end of a deal, it scores 7.

## Option: Matching number

Turn on **Matching number** on the start screen or in the lobby.

- Played **alone**, the sister-color card with the same number as the target counts as the target's color. On a Blue 6, a Green 6 played by itself counts as a Blue 6, so it beats lower Blue cards.
- In a combo it's just a normal card.
- Higher cards of the real target color still beat it, and a real target-color card with the same number wins an exact tie.
- Tip for the table: hold your chosen cards face down in your hand and everyone reveals at once, so nobody can react to how many cards someone is playing.

## Scoring

- Positive cards score their value.
- Each negative scores +5, unless it pairs with a positive card of the same suit in your hand. Then it subtracts its value instead (Blue 8 + Blue −3 = 5).
- Black negatives never pair.
- Lowest score wins. Play three deals, or play until someone reaches 50.

### Scoring options

Choose **Scoring** on the start screen or in the lobby:

- **Tiers** (default): cards 1–3 score 1, 4–7 score 3, 8–10 score 5. Negatives score +5 unless paired, as in face value.
- **Face value:** as above.
- **Card count:** every card left in your hand scores 1, every negative scores 2. Negatives never pair.

"Play to" scales with the scoring: 25 with Tiers, 50 with Face value, 10 with Card count.

## Setup by player count

| Players | Main deck | Cards each | Negative sets |
| --- | --- | --- | --- |
| 2 | Red, Orange, Blue, Green, no doubles (40) | 11 | Those 4 suits |
| 3–4, Most of the color | All six suits, Purple and Grey with no doubles (80) | 11 | All six suits |
| 3–4, Highest card | All six suits, Purple and Grey 6–10 only (70) | 11 | All six suits |
| 5–6 | All six suits (90) | 11 | All six suits |
| 7 | All six suits (90) | 11 | Six suits + 1 black |
| 8 | All six suits (90) | 10 | Six suits + 2 black |

Each suit runs 1–10 with two copies of 1–5; one copy of each doubled card carries a star. Every player starts with one −1, −2 and −3 dealt from the negative piles.

When the draw pile runs out, shuffle the discards into a new draw pile. With 2 players, the first time nobody can make the target, flip a new target instead of ending the deal.

## Files

- `index.html`: the game screens: start screen, lobby and table
- `engine.js`: the rules engine and computer players, shared by the page and the server
- `server.js`: serves the page and runs online games over WebSockets
- `cards/`: card artwork

## Running it yourself

```
npm install
npm start
```

Then open http://localhost:3000. On Render this runs as a Node web service with build command `npm install` and start command `npm start`.
