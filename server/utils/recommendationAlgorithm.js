//buildMovieVector
export const buildMovieVector = (movie) => {
  const vector = {};
  // Genre features
  if (movie.genres && Array.isArray(movie.genres)) {
    for (let i = 0; i < movie.genres.length; i++) {
      const genre = movie.genres[i];
      let genreName = "";
      if (typeof genre === "string") {
        genreName = genre;
      } else if (genre && genre.name) {
        genreName = genre.name;
      }
      if (genreName !== "") {
        const feature = "genre:" + genreName.toLowerCase();
        vector[feature] = 2;
      }
    }
  }
  // Cast features
  if (movie.casts && Array.isArray(movie.casts)) {
    let castLimit = movie.casts.length;
    if (castLimit > 10) {
      castLimit = 10;
    }
    for (let i = 0; i < castLimit; i++) {
      const cast = movie.casts[i];
      let castName = "";
      if (typeof cast === "string") {
        castName = cast;
      } else if (cast && cast.name) {
        castName = cast.name;
      }
      if (castName !== "") {
        const feature = "cast:" + castName.toLowerCase();
        vector[feature] = 3;
      }
    }
  }
  return vector;
};

//buildUserPreferenceVector
export const buildUserPreferenceVector = (favoriteMovies) => {
  const userVector = {};
  for (let i = 0; i < favoriteMovies.length; i++) {
    const movie = favoriteMovies[i];
    const movieVector = buildMovieVector(movie);
    for (const feature in movieVector) {
      const value = movieVector[feature];
      if (userVector[feature] !== undefined) {
        userVector[feature] = userVector[feature] + value;
      } else {
        userVector[feature] = value;
      }
    }
  }
  return userVector;
};

// Calculate Cosine Similarity
export const cosineSimilarity = (vectorA, vectorB) => {
  const allFeatures = [];
  // Add all features from vectorA
  for (const feature in vectorA) {
    allFeatures[allFeatures.length] = feature;
  }
  // Add features from vectorB only if they are not already present
  for (const feature in vectorB) {
    let alreadyExists = false;
    for (let i = 0; i < allFeatures.length; i++) {
      if (allFeatures[i] === feature) {
        alreadyExists = true;
        break;
      }
    }
    if (alreadyExists === false) {
      allFeatures[allFeatures.length] = feature;
    }
  }
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  // Compare both vectors feature by feature
  for (let i = 0; i < allFeatures.length; i++) {
    const feature = allFeatures[i];
    let valueA = 0;
    let valueB = 0;
    // Get value from vectorA
    if (vectorA[feature] !== undefined) {
      valueA = vectorA[feature];
    }
    // Get value from vectorB
    if (vectorB[feature] !== undefined) {
      valueB = vectorB[feature];
    }
    // Dot product
    dotProduct = dotProduct + valueA * valueB;

    // Magnitude of vectorA
    magnitudeA = magnitudeA + valueA * valueA;

    // Magnitude of vectorB
    magnitudeB = magnitudeB + valueB * valueB;
  }
  // Prevent division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  const lengthA = Math.sqrt(magnitudeA);

  const lengthB = Math.sqrt(magnitudeB);

  const similarity = dotProduct / (lengthA * lengthB);

  return similarity;
};

// Convert movie rating from 0-10 into 0-1 range

export const normalizeRating = (rating) => {
  if (rating === undefined || rating === null) {
    return 0;
  }
  return rating / 10;
};

// Calculate similarity between two users
// based on their favourite movie IDs

export const jaccardSimilarity = (userFavoritesA, userFavoritesB) => {

  if (
    !userFavoritesA ||
    !userFavoritesB ||
    userFavoritesA.length === 0 ||
    userFavoritesB.length === 0
  ) {
    return 0;
  }
  let intersectionCount = 0;


  // Count movies common to both users
  for (let i = 0; i < userFavoritesA.length; i++) {
    const movieA = userFavoritesA[i].toString();
    for (let j = 0; j < userFavoritesB.length; j++) {
      const movieB = userFavoritesB[j].toString();
      if (movieA === movieB) {
        intersectionCount = intersectionCount + 1;
        break;
      }
    }
  }
  // Jaccard union formula:   |A ∪ B| = |A| + |B| - |A ∩ B|
  const unionCount =
    userFavoritesA.length + userFavoritesB.length - intersectionCount;
  if (unionCount === 0) {
    return 0;
  }
  const similarity = intersectionCount / unionCount;
  return similarity;
};

export const findKNearestNeighbors = (currentUserFavorites, otherUsers,k = 5,) => {
  const neighbors = [];
  // Compare current user with every other user
  for (let i = 0; i < otherUsers.length; i++) {
    const otherUser = otherUsers[i];
    const similarity = jaccardSimilarity(
      currentUserFavorites,
      otherUser.favorites,
    );

    // Ignore users with no similarity
    if (similarity > 0) {
      neighbors.push({
        userId: otherUser.userId,
        favorites: otherUser.favorites,
        similarity: similarity,
      });
    }
  }
  // Sort users by highest similarity using Selection Sort
  for (let i = 0; i < neighbors.length - 1; i++) {
    let highestIndex = i;
    for (let j = i + 1; j < neighbors.length; j++) {
      if (neighbors[j].similarity > neighbors[highestIndex].similarity) {
        highestIndex = j;
      }
    }
    if (highestIndex !== i) {
      const temporary = neighbors[i];
      neighbors[i] = neighbors[highestIndex];
      neighbors[highestIndex] = temporary;
    }
  }
  // Return maximum K nearest users
  const nearestNeighbors = [];
  const limit = neighbors.length < k ? neighbors.length : k;
  for (let i = 0; i < limit; i++) {
    nearestNeighbors.push(neighbors[i]);
  }
  return nearestNeighbors;
};

export const calculateNeighborWeightedScores = (currentUserFavorites, nearestNeighbors,) => {
  const candidates = [];

  // No neighbours means no collaborative recommendations
  if (!nearestNeighbors || nearestNeighbors.length === 0) {
    return candidates;
  }

  // Calculate total similarity of all selected neighbours
  let totalSimilarity = 0;
  for (let i = 0; i < nearestNeighbors.length; i++) {
    totalSimilarity = totalSimilarity + nearestNeighbors[i].similarity;
  }
  if (totalSimilarity === 0) {
    return candidates;
  }

  // Examine favourite movies of each neighbour
  for (let i = 0; i < nearestNeighbors.length; i++) {
    const neighbor = nearestNeighbors[i];
    const neighborFavorites = neighbor.favorites || [];
    for (let j = 0; j < neighborFavorites.length; j++) {
      const movieId = neighborFavorites[j].toString();

      // Check whether current user already has this movie as favourite
      let alreadyFavorite = false;
      for (let k = 0; k < currentUserFavorites.length; k++) {
        if (currentUserFavorites[k].toString() === movieId) {
          alreadyFavorite = true;
          break;
        }
      }

      // Do not recommend an existing favourite
      if (alreadyFavorite) {
        continue;
      }

      // Check whether this candidate  was already added by another neighbour
      let existingCandidateIndex = -1;
      for (let k = 0; k < candidates.length; k++) {
        if (candidates[k].movieId === movieId) {
          existingCandidateIndex = k;
          break;
        }
      }
      if (existingCandidateIndex === -1) {

        // First neighbour recommending this movie
        candidates.push({
          movieId: movieId,
          weightedScore: neighbor.similarity,
        });
      } else {
        
        // Another similar neighbour also recommends the same movie
        candidates[existingCandidateIndex].weightedScore =
          candidates[existingCandidateIndex].weightedScore +
          neighbor.similarity;
      }
    }
  }
  // Convert accumulated weight into final collaborative score
  for (let i = 0; i < candidates.length; i++) {
    candidates[i].recommendationScore =
      candidates[i].weightedScore / totalSimilarity;
  }
  return candidates;
};

export const sortRecommendationsByScore = (candidates) => {
  if (!candidates || candidates.length === 0) {
    return [];
  }
  // Create a copy so the original array
  // is not modified
  const sortedCandidates = [...candidates];
  // Selection Sort in descending order
  for (let i = 0; i < sortedCandidates.length - 1; i++) {
    let highestIndex = i;
    for (let j = i + 1; j < sortedCandidates.length; j++) {
      if (
        sortedCandidates[j].recommendationScore >
        sortedCandidates[highestIndex].recommendationScore
      ) {
        highestIndex = j;
      }
    }
    if (highestIndex !== i) {
      const temp = sortedCandidates[i];
      sortedCandidates[i] = sortedCandidates[highestIndex];
      sortedCandidates[highestIndex] = temp;
    }
  }
  return sortedCandidates;
};
