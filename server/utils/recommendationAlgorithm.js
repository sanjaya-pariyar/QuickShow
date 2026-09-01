
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
        const feature =
          "genre:" + genreName.toLowerCase();
        vector[feature] = 1;
      }
    }
  }


  // Cast features
  if (movie.casts && Array.isArray(movie.casts)) {
    let castLimit = movie.casts.length;
    if (castLimit > 10) {
      castLimit = 10
    };
    for (let i = 0; i < castLimit; i++) {
      const cast = movie.casts[i];
      let castName = "";
      if (typeof cast === "string") {
        castName = cast;
      } else if (cast && cast.name) {
        castName = cast.name;
      }
      if (castName !== "") {
        const feature =
          "cast:" + castName.toLowerCase();
        vector[feature] = 1;
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
    const movieVector =
      buildMovieVector(movie);
    for (const feature in movieVector) {
      const value =
        movieVector[feature];
      if (
        userVector[feature] !== undefined
      ) {
        userVector[feature] =
          userVector[feature] + value;
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

  // Add features from vectorB
  // only if they are not already present
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
    dotProduct =
      dotProduct + (valueA * valueB);


    // Magnitude of vectorA
    magnitudeA =
      magnitudeA + (valueA * valueA);


    // Magnitude of vectorB
    magnitudeB =
      magnitudeB + (valueB * valueB);
  }

  // Prevent division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }


  const lengthA =
    Math.sqrt(magnitudeA);

  const lengthB =
    Math.sqrt(magnitudeB);


  const similarity =
    dotProduct / (lengthA * lengthB);


  return similarity;
};