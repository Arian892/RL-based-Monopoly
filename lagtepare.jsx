
// async function runAITurn() {
//   setIsAITurn(true);

//   const player = players[currentPlayer];
//   if (!player) return;

//   // Small delay for realism
//   await delay(800);

//   // Handle jail first
//   if (player.inJail) {
//     await handleAIJail();
//     setIsAITurn(false);
//     return;
//   }

//   // Roll dice
//   rollDice();

//   // Wait for movement animation to finish
//   await waitForRollToFinish();

//   // Handle property auto decision
//   await handleAIAfterLanding();

//   // Small delay before ending turn
//   await delay(800);

//   endTurn();
//   setIsAITurn(false);
// }

// function waitForRollToFinish() {
//   return new Promise(resolve => {
//     const interval = setInterval(() => {
//       if (!rolling) {
//         clearInterval(interval);
//         resolve();
//       }
//     }, 100);
//   });
// }

// async function handleAIAfterLanding() {
//   await delay(600);

//   if (!activeCell) return;

//   const price = activeCell.price;
//   const money = players[currentPlayer].money;

//   // Simple logic: keep 200 buffer
//   if (money > price + 200) {
//     buyProperty();
//   } else {
//     skipProperty();
//   }
// }

// function handleAIPropertyDecision(cell) {
//   const money = players[currentPlayer].money;

//   if (money > cell.price + 200) {
//     setOwnership(prev => ({
//       ...prev,
//       [cell.id]: currentPlayer,
//     }));

//     updateMoney(currentPlayer, -cell.price);
//   }
// }

async function handleAIJail() {
  const player = players[currentPlayer];

  await delay(800);

  // If has jail free card → use it
  if (player.jailFreeCard) {
    releaseFromJail(currentPlayer);
    setPlayers(prev =>
      prev.map((p, i) =>
        i === currentPlayer
          ? { ...p, jailFreeCard: false }
          : p
      )
    );
    return;
  }

  // If enough money → pay
  if (player.money >= 300) {
    updateMoney(currentPlayer, -100);
    releaseFromJail(currentPlayer);
    return;
  }

  // Otherwise stay
  setPlayers(prev =>
    prev.map((p, i) => {
      if (i !== currentPlayer) return p;

      const nextTurns = p.jailTurnsLeft - 1;

      return {
        ...p,
        jailTurnsLeft: nextTurns,
        inJail: nextTurns > 0,
      };
    })
  );

  setHasRolled(true);
  endTurn();
}

