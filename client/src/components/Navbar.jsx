import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { assets } from "../assets/assets";
import { MenuIcon, SearchIcon, TicketPlus, User, XIcon } from "lucide-react";
import { useClerk, UserButton, useUser } from "@clerk/react";
import { useAppContext } from "../context/AppContext";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user } = useUser();
  const { openSignIn } = useClerk();
  const navigate = useNavigate();

  const { favoriteMovies, shows, image_base_url } = useAppContext();
  const handleSearch = (e) => {
    e.preventDefault();

    const query = searchQuery.trim();

    if (query) {
      navigate(`/movies?search=${encodeURIComponent(query)}`);
    } else {
      navigate("/movies");
    }

    setSearchOpen(false);
    setIsOpen(false);
    window.scrollTo(0, 0);
  };

  const handleSuggestionClick = (movie) => {
    setSearchQuery(movie.title);

    navigate(`/movies?search=${encodeURIComponent(movie.title)}`);

    setSearchOpen(false);
    window.scrollTo(0, 0);
  };

  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return [];

    return shows
      .filter((movie) => movie.title?.toLowerCase().includes(query))
      .sort((a, b) => {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();

        const aStarts = titleA.startsWith(query);
        const bStarts = titleB.startsWith(query);

        // Movies beginning with the search text appear first
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;

        return titleA.localeCompare(titleB);
      })
      .slice(0, 6);
  }, [searchQuery, shows]);

  return (
    <div className="fixed top-0 left-0 z-50 w-full flex items-center justify-between px-6 md:pxp-16 lg:px-36 py-5">
      <Link to="/" className="max-md:flex-1">
        <img
          src={assets.logo}
          alt=""
          className="w-36 h-auto"
          onClick={() => scrollTo(0, 0)}
        />
      </Link>

      <div
        className={`max-md:absolute max-md:top-0 max-md:left-0 max-md:font-medium max-md:text-lg z-50 flex flex-col md:flex-row items-center max-md:justify-center gap-8 min-md:px-8 py-3 max-md:h-screen min-md:rounded-full backdrop-blur bg-black/70 md:bg-white/10 md:border border-gray-300/20 overflow-hidden transition-[width] duration-300 ${isOpen ? "max-md:w-full" : "max-md:w-0"}`}
      >
        <XIcon
          className="md:hidden absolute top-6 right-6 w-6 h-6 cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        />

        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/"
        >
          Home
        </Link>
        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/movies"
        >
          Movies
        </Link>
        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/"
        >
          Theaters
        </Link>
        <Link
          onClick={() => {
            scrollTo(0, 0);
            setIsOpen(false);
          }}
          to="/"
        >
          Releases
        </Link>
        {favoriteMovies.length > 0 && (
          <Link
            onClick={() => {
              scrollTo(0, 0);
              setIsOpen(false);
            }}
            to="/favourite"
          >
            Favorites
          </Link>
        )}
      </div>

      <div className="flex items-center gap-8">
        <div className="relative max-md:hidden">
          <div className="flex items-center gap-3">
            {searchOpen && (
              <form
                onSubmit={handleSearch}
                className="flex items-center bg-black/90 border border-gray-600 rounded-full px-4 py-2 w-72"
              >
                <input
                  type="text"
                  autoFocus
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent outline-none text-sm text-white placeholder:text-gray-400 flex-1"
                />

                <XIcon
                  className="w-4 h-4 cursor-pointer text-gray-400 hover:text-white"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                />
              </form>
            )}

            <SearchIcon
              className="w-6 h-6 cursor-pointer"
              onClick={() => setSearchOpen((prev) => !prev)}
            />
          </div>

          {searchOpen && searchQuery.trim() && (
            <div className="absolute top-12 left-0 w-72 bg-black/95 border border-gray-700 rounded-xl overflow-hidden shadow-xl">
              {searchSuggestions.length > 0 ? (
                searchSuggestions.map((movie) => (
                  <button
                    type="button"
                    key={movie._id}
                    onClick={() => handleSuggestionClick(movie)}
                    className="w-full flex items-center gap-3 text-left px-3 py-2 hover:bg-white/10 transition border-b border-gray-800 last:border-none"
                  >
                    <img
                      src={image_base_url + movie.poster_path}
                      alt={movie.title}
                      className="w-10 h-14 object-cover rounded"
                    />

                    <div>
                      <p className="text-sm text-white">{movie.title}</p>

                      {movie.release_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          {movie.release_date.split("-")[0]}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-sm text-gray-400">
                  No matching movies found
                </div>
              )}
            </div>
          )}
        </div>
        {!user ? (
          <button
            onClick={openSignIn}
            className="px-4 py-1 sm:px-7 sm:py-2 bg-primary hover:bg-primary-dull transition rounded-full font-medium cursor-pointer"
          >
            Login
          </button>
        ) : (
          <UserButton>
            <UserButton.MenuItems>
              <UserButton.Action
                label="My Bookings"
                labelIcon={<TicketPlus width={15} />}
                onClick={() => navigate("/my-bookings")}
              />
            </UserButton.MenuItems>
          </UserButton>
        )}
      </div>
      <MenuIcon
        className="max-md:ml-4 md:hidden w-8 h-8 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      />
    </div>
  );
};

export default Navbar;
