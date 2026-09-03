import React, { useEffect, useState } from "react";
import { dummyShowsData } from "../../assets/assets";
import Loading from "../../components/Loading";
import Title from "../../components/admin/Title";
import { dateFormat } from "../../lib/dateFormat";
import { useAppContext } from "../../context/AppContext";
import toast from "react-hot-toast";

const ListShows = () => {
  const { axios, getToken, user } = useAppContext();
  const currency = import.meta.env.VITE_CURRENCY;

  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingShow, setEditingShow] = useState(null);
  const [showDateTime, setShowDateTime] = useState("");
  const [showPrice, setShowPrice] = useState("");

  const getAllShows = async () => {
    try {
      const { data } = await axios.get("/api/admin/all-shows", {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });
      setShows(data.shows);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (user) {
      getAllShows();
    }
  }, [user]);

  const openEditModal = (show) => {
    setEditingShow(show);

    const formattedDate = new Date(show.showDateTime)
      .toISOString()
      .slice(0, 16);

    setShowDateTime(formattedDate);

    setShowPrice(show.showPrice);
  };

  const updateShow = async () => {
    try {
      const { data } = await axios.put(
        `/api/show/${editingShow._id}`,
        {
          showDateTime,
          showPrice,
        },
        {
          headers: {
            Authorization: `Bearer ${await getToken()}`,
          },
        },
      );

      if (data.success) {
        toast.success("Show updated successfully");

        setEditingShow(null);

        getAllShows();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);

      toast.error(error.response?.data?.message || "Update failed");
    }
  };

  
  const deleteShow = async (showId) => {
  try {
    const confirmDelete =
      window.confirm(
        "Are you sure you want to delete this show?"
      );
    if (!confirmDelete) {
      return;
    }
    const {data} =
      await axios.delete(
        `/api/show/${showId}`,
        {
          headers:{
            Authorization:
            `Bearer ${await getToken()}`
          }
        }
      );
    if(data.success){

      toast.success(
        "Show deleted successfully"
      );

      getAllShows();
    }
    else{

      toast.error(
        data.message
      );
    }
  } catch(error){
    console.error(error);
    toast.error(
      error.response?.data?.message ||
      "Delete failed"
    );

  }

};
  return !loading ? (
    <>
      <Title text1="List" text2="Shows" />
      <div className="max-w-4xl mt-6 overflow-x-auto">
        <table className="w-full border-collapse rounded-md overflow-hidden text-nowrap">
          <thead>
            <tr className="bg-primary/20 text-left text-white">
              <th className="p-2 font-medium pl-5">Movie Name</th>
              <th className="p-2 font-medium ">Show Time</th>
              <th className="p-2 font-medium ">Total Bookings</th>
              <th className="p-2 font-medium ">Earnings </th>
              <th className="p-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="text-sm font-light">
            {shows.map((show, index) => (
              <tr
                key={index}
                className="border-b border-primary/10 bg-primary/5 even:bg-primary/10"
              >
                <td className="p-2 min-w-45 pl-5">{show.movie.title}</td>
                <td className="p-2">{dateFormat(show.showDateTime)}</td>
                <td className="p-2">
                  {Object.keys(show.occupiedSeats).length}
                </td>
                <td className="p-2">
                  {currency}{" "}
                  {Object.keys(show.occupiedSeats).length * show.showPrice}
                </td>
                <td className="p-2">
                  <button
                    onClick={() => openEditModal(show)}
                    className="bg-primary text-white px-3 py-1 rounded">
                    Edit
                  </button>
                </td>
                <td className="p-2">
                  <button onClick={() => deleteShow(show._id)} className="bg-red-600 text-white px-3 py-1 rounded ml-2">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingShow && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" >
          <div
            className="bg-white p-6 rounded-lg w-96 text-black ">
            <h2
              className="text-xl font-semibold mb-4" >
              Edit Show
            </h2>
            <label>Show Date & Time</label>
            <input
              type="datetime-local"
              value={showDateTime}
              onChange={(e) => setShowDateTime(e.target.value)}
              className="border w-full p-2 mb-4"/>
            <label>Ticket Price</label>
            <input
              type="number"
              value={showPrice}
              onChange={(e) => setShowPrice(e.target.value)}
              className="border w-full p-2 mb-4"
            />

            <div
              className="flex justify-end gap-3">
              <button
                onClick={() => setEditingShow(null)}
                className="border px-4 py-2 rounded">
                Cancel
              </button>

              <button
                onClick={updateShow}
                className="bg-primary text-white px-4 py-2 rounded">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  ) : (
    <Loading />
  );
};


export default ListShows;
