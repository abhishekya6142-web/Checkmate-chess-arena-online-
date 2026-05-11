
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  addDoc,
  getDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { MultiplayerGame, Color } from './types';

const GAMES_COLLECTION = 'games';

export const createGame = async (uid: string, startingFen?: string): Promise<string> => {
  try {
    const gameData = {
      fen: startingFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      history: [],
      players: { w: uid },
      status: 'waiting',
      turn: 'w',
      winner: null,
      lastMoveAt: serverTimestamp(),
    };
    const docRef = await addDoc(collection(db, GAMES_COLLECTION), gameData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, GAMES_COLLECTION);
    return '';
  }
};

export const joinGame = async (gameId: string, uid: string): Promise<boolean> => {
  try {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    const gameSnap = await getDoc(gameRef);
    
    if (!gameSnap.exists()) return false;
    
    const gameData = gameSnap.data();
    // Already in as white or black
    if (gameData.players.w === uid || gameData.players.b === uid) return true; 
    
    // Check if game is already full
    if (gameData.players.b) {
      console.warn("Game is already full");
      return false;
    }
    
    await updateDoc(gameRef, {
      'players.b': uid,
      status: 'active',
      lastMoveAt: serverTimestamp(),
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${GAMES_COLLECTION}/${gameId}`);
    return false;
  }
};

export const updateGameMove = async (gameId: string, fen: string, history: string[], turn: Color, winner: string | 'draw' | null) => {
  try {
    const gameRef = doc(db, GAMES_COLLECTION, gameId);
    await updateDoc(gameRef, {
      fen,
      history,
      turn,
      winner,
      lastMoveAt: serverTimestamp(),
      status: winner ? 'finished' : 'active'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${GAMES_COLLECTION}/${gameId}`);
  }
};

export const subscribeToGame = (gameId: string, callback: (game: MultiplayerGame) => void) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  return onSnapshot(gameRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as MultiplayerGame);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, `${GAMES_COLLECTION}/${gameId}`);
  });
};

export const getAvailableGames = async (): Promise<MultiplayerGame[]> => {
  try {
    const q = query(collection(db, GAMES_COLLECTION), where('status', '==', 'waiting'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MultiplayerGame));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, GAMES_COLLECTION);
    return [];
  }
};
