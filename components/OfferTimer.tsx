"use client";

import { useEffect, useState } from "react";

export default function OfferTimer() {

  const [secondsLeft, setSecondsLeft] = useState(3600);


  useEffect(() => {

    const savedTime = localStorage.getItem("aven_offer_timer");


    if (savedTime) {
      setSecondsLeft(Number(savedTime));
    }


    const timer = setInterval(() => {

      setSecondsLeft((prev) => {

        if (prev <= 1) {

          localStorage.removeItem("aven_offer_timer");

          return 0;

        }


        const newTime = prev - 1;

        localStorage.setItem(
          "aven_offer_timer",
          String(newTime)
        );


        return newTime;

      });


    }, 1000);



    return () => clearInterval(timer);


  }, []);





  const hours = Math.floor(secondsLeft / 3600);

  const minutes = Math.floor(
    (secondsLeft % 3600) / 60
  );

  const seconds = secondsLeft % 60;



  return (

    <div className="mt-6 rounded-2xl bg-black text-white p-5 text-center">


      <p className="uppercase tracking-[3px] text-sm text-gray-300">
        🔥 Limited Time Offer
      </p>



      <div className="mt-3 text-4xl font-bold">

        {String(hours).padStart(2, "0")}:
        {String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}

      </div>



      <p className="mt-2 text-sm text-gray-400">
        Hurry! Offer ending soon
      </p>


    </div>

  );

}