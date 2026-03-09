import DashboardNavigation from "../components/dashboardNavigation.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function UserDashboard() {
    const { user } = useAuth();

    return (
        <div className="flex min-h-screen font-[roboto]">
            <DashboardNavigation />

            <main className="flex-1 p-6">
                <h1 className="text-2xl font-semibold mb-2">
                    Maligayang araw{user?.username ? `, ${user.username}` : ""}!
                </h1>
                {user?.role && (
                    <p className="text-sm text-gray-600">
                        You are logged in as <span className="font-semibold">{user.role}</span>.
                    </p>
                )}
            </main>
        </div>
    );
}

export default UserDashboard;