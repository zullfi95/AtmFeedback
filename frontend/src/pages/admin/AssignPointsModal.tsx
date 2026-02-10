import { useState } from 'react';
import type { User, ServicePoint } from './types';

export interface AssignPointsModalProps {
  user: User;
  allPoints: ServicePoint[];
  assignedPointIds: string[];
  onClose: () => void;
  onSave: (pointIds: string[]) => void;
}

export default function AssignPointsModal({ user, allPoints, assignedPointIds, onClose, onSave }: AssignPointsModalProps) {
  const [selectedPoints, setSelectedPoints] = useState<string[]>(assignedPointIds);

  const groupedPoints = (allPoints || []).reduce((acc: Record<string, { companyId: string; companyName: string; points: ServicePoint[] }>, point) => {
    const companyId = point.companyId || 'no-company';
    const companyName = point.company?.name || 'No Company';

    if (!acc[companyId]) {
      acc[companyId] = {
        companyId,
        companyName,
        points: [],
      };
    }
    acc[companyId].points.push(point);
    return acc;
  }, {});

  const handleTogglePoint = (pointId: string) => {
    setSelectedPoints((prev) =>
      prev.includes(pointId) ? prev.filter((id) => id !== pointId) : [...prev, pointId]
    );
  };

  const handleToggleCompany = (companyPoints: ServicePoint[]) => {
    const companyPointIds = companyPoints.map((p) => p.id);
    const allSelected = companyPointIds.every((id) => selectedPoints.includes(id));

    if (allSelected) {
      setSelectedPoints((prev) => prev.filter((id) => !companyPointIds.includes(id)));
    } else {
      setSelectedPoints((prev) => {
        const newSelected = [...prev];
        companyPointIds.forEach((id) => {
          if (!newSelected.includes(id)) newSelected.push(id);
        });
        return newSelected;
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assign Service Points to {user.username}
        </h3>

        <div className="space-y-4 mb-4">
          {Object.values(groupedPoints).map((group: any) => {
            const companyPointIds = group.points.map((p: ServicePoint) => p.id);
            const allSelected = companyPointIds.length > 0 && companyPointIds.every((id: string) => selectedPoints.includes(id));
            const someSelected = companyPointIds.some((id: string) => selectedPoints.includes(id));

            return (
              <div key={group.companyId} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={() => handleToggleCompany(group.points)}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{group.companyName}</div>
                      <div className="text-xs text-gray-500">
                        {companyPointIds.filter((id: string) => selectedPoints.includes(id)).length} / {group.points.length} points selected
                      </div>
                    </div>
                  </label>
                </div>
                <div className="divide-y divide-gray-100">
                  {group.points.map((point: ServicePoint) => (
                    <label key={point.id} className="flex items-center space-x-3 p-3 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPoints.includes(point.id)}
                        onChange={() => handleTogglePoint(point.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded ml-7"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                            point.type === 'ATM' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {point.type}
                          </span>
                          <div className="text-sm font-medium text-gray-900">{point.name}</div>
                        </div>
                        <div className="text-sm text-gray-500">{point.address}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{selectedPoints.length}</span> point(s) selected
          </div>
          <div className="flex space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(selectedPoints)}
              className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark"
            >
              Save Assignments
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
