import Pricing from "../components/Pricing";
import { useCredits } from "../hooks/useCredits";

const Plans = () => {
  const { fetchCredits } = useCredits();
  return (
    <div className="max-sm:py-10 sm:pt-20" >
      <Pricing />
      <button
        onClick={fetchCredits}
        className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded"
      >
        Refresh Credits
      </button>
      <p className="text-center text-gray-400 max-w-md text-sm my-14 mx-auto px-12 " >
        Create stunning images for just <span className="text-indigo-400 font-medium" >5 credits</span>  and  generate impersive videos for <span className="text-indigo-400 font-medium" > 10 credits</span>
      </p>
    </div>
  );
}

export default Plans;